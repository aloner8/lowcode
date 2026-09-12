import type {
  AppComponentInstanceDefinition,
  JsonValue,
  LifecyclePhase,
  PageCollectionLoadDefinition,
  PageRuntimeContext,
  RuntimeRequestToken,
  ScreenEventPhase,
  ScreenEventStepDefinition,
  ScreenRuntimeContext,
  TemplateDefinition,
} from "@/lib/template/contracts";

export interface LifecycleTraceEvent {
  phase: LifecyclePhase;
  routeId: string;
  screenId: string;
  screenInstanceId: string;
  pageId?: string;
  pageInstanceId?: string;
  requestId: string;
}

export interface LifecycleFailure {
  phase: LifecyclePhase;
  objectId: string;
  requestId: string;
  error: unknown;
}

export interface LifecycleAdapter {
  emit(event: LifecycleTraceEvent): void | Promise<void>;
  runScreenStep(
    step: ScreenEventStepDefinition,
    context: ScreenRuntimeContext,
    signal: AbortSignal,
  ): void | Promise<void>;
  loadCollection(
    load: PageCollectionLoadDefinition,
    context: PageRuntimeContext,
    signal: AbortSignal,
  ): Promise<JsonValue>;
  prepareScreenComponent(
    component: AppComponentInstanceDefinition,
    context: ScreenRuntimeContext,
    signal: AbortSignal,
  ): void | Promise<void>;
  prepareComponent(
    component: AppComponentInstanceDefinition,
    context: PageRuntimeContext,
    signal: AbortSignal,
  ): void | Promise<void>;
  onFailure?(failure: LifecycleFailure): void | Promise<void>;
}

export type LifecycleResult =
  | {
      status: "ready";
      screen: ScreenRuntimeContext;
      page: PageRuntimeContext;
    }
  | { status: "cancelled" }
  | { status: "error"; failure: LifecycleFailure };

type IdFactory = (scope: "request" | "screen" | "page") => string;

const defaultIdFactory: IdFactory = (scope) => `${scope}:${crypto.randomUUID()}`;

class CancelledLifecycle extends Error {
  constructor() {
    super("Lifecycle request was cancelled");
  }
}

class LifecycleExecutionFailure extends Error {
  constructor(
    readonly phase: LifecyclePhase,
    readonly objectId: string,
    options: { cause: unknown },
  ) {
    super(`Lifecycle failed during ${phase} for '${objectId}'`, options);
  }
}

const SCREEN_STEP_PHASE: Record<ScreenEventPhase, LifecyclePhase> = {
  onload: "screen_onload",
  afterLoad: "screen_after_load",
  setLayout: "screen_set_layout",
  afterSetLayout: "screen_after_set_layout",
  changePage: "screen_change_page",
  afterChangePage: "screen_after_change_page",
};

interface ActiveRequest {
  controller: AbortController;
  token: RuntimeRequestToken;
}

export class LifecycleRunner {
  private readonly idFactory: IdFactory;
  private activeScreenRequest: ActiveRequest | null = null;
  private activePageRequest: ActiveRequest | null = null;
  private screenContext: ScreenRuntimeContext | null = null;
  private pageContext: PageRuntimeContext | null = null;

  constructor(
    private readonly definition: TemplateDefinition,
    private readonly appId: string,
    private readonly templateRevision: string,
    private readonly adapter: LifecycleAdapter,
    idFactory: IdFactory = defaultIdFactory,
  ) {
    this.idFactory = idFactory;
  }

  get currentScreen(): ScreenRuntimeContext | null {
    return this.screenContext;
  }

  get currentPage(): PageRuntimeContext | null {
    return this.pageContext;
  }

  cancel(): void {
    this.cancelRequest(this.activePageRequest);
    this.cancelRequest(this.activeScreenRequest);
    this.activePageRequest = null;
    this.activeScreenRequest = null;
  }

  async navigateRoute(
    routeId: string,
    params: Record<string, JsonValue> = {},
  ): Promise<LifecycleResult> {
    const route = this.definition.routes.find((candidate) => candidate.id === routeId);
    if (!route) throw new Error(`Route '${routeId}' was not found`);
    const screen = this.definition.screens.find(
      (candidate) => candidate.id === route.screenId,
    );
    if (!screen) throw new Error(`Screen '${route.screenId}' was not found`);

    this.cancel();
    const request = this.createRequest(this.idFactory("screen"));
    this.activeScreenRequest = request;
    this.pageContext = null;
    const context: ScreenRuntimeContext = {
      appId: this.appId,
      templateRevision: this.templateRevision,
      routeId,
      screenId: screen.id,
      screenInstanceId: request.token.screenInstanceId,
      desiredPageId: screen.defaultPageId,
      params: structuredClone(params),
      data: {},
      memory: {},
      token: request.token,
    };
    this.screenContext = context;

    try {
      await this.emit("app_startup", context);
      await this.emit("screen_onload", context);
      await this.runSteps("onload", screen.eventSteps, context, request.controller.signal);
      await this.emit("screen_load_complete", context);
      await this.emit("screen_after_load", context);
      await this.runSteps("afterLoad", screen.eventSteps, context, request.controller.signal);
      await this.emit("screen_set_layout", context);
      await this.runSteps("setLayout", screen.eventSteps, context, request.controller.signal);
      const screenComponents = this.definition.componentInstances
        .filter(
          (component) =>
            component.placement === "screen_region" &&
            component.screenId === screen.id,
        )
        .sort((left, right) => left.loadOrder - right.loadOrder);
      for (const component of screenComponents) {
        this.assertCurrent(request, this.activeScreenRequest);
        await this.execute(
          "screen_component_prepare",
          component.id,
          () => this.adapter.prepareScreenComponent(
            component,
            context,
            request.controller.signal,
          ),
        );
      }
      await this.emit("screen_set_layout_complete", context);
      await this.emit("screen_after_set_layout", context);
      await this.runSteps("afterSetLayout", screen.eventSteps, context, request.controller.signal);
      this.assertCurrent(request, this.activeScreenRequest);
      return await this.changePage(screen.defaultPageId, params, true);
    } catch (error) {
      return this.handleFailure(error, "screen_onload", screen.id, request);
    }
  }

  reload(params: Record<string, JsonValue> = {}): Promise<LifecycleResult> {
    if (!this.screenContext) throw new Error("Cannot reload before navigating to a Route");
    return this.navigateRoute(this.screenContext.routeId, params);
  }

  async changePage(
    pageId: string,
    params: Record<string, JsonValue> = {},
    fromRouteNavigation = false,
  ): Promise<LifecycleResult> {
    const screenContext = this.screenContext;
    if (!screenContext) throw new Error("Cannot change Page without an active Screen");
    const page = this.definition.pages.find((candidate) => candidate.id === pageId);
    if (!page) throw new Error(`Page '${pageId}' was not found`);
    const belongsToScreen = this.definition.screenPages.some(
      (entry) => entry.screenId === screenContext.screenId && entry.pageId === pageId,
    );
    if (!belongsToScreen) {
      throw new Error(`Page '${pageId}' is not assigned to Screen '${screenContext.screenId}'`);
    }

    this.cancelRequest(this.activePageRequest);
    const request = this.createRequest(screenContext.screenInstanceId);
    this.activePageRequest = request;
    screenContext.desiredPageId = pageId;
    screenContext.token = request.token;
    const pageContext: PageRuntimeContext = {
      pageId,
      pageInstanceId: request.token.targetPageInstanceId!,
      params: structuredClone(params),
      data: {},
      memory: {},
      token: request.token,
    };

    const screen = this.definition.screens.find(
      (candidate) => candidate.id === screenContext.screenId,
    )!;
    try {
      await this.emit("screen_change_page", screenContext, pageContext);
      await this.runSteps(
        "changePage",
        screen.eventSteps,
        screenContext,
        request.controller.signal,
      );
      await this.emit("page_onload", screenContext, pageContext);

      for (const load of [...page.collections].sort(
        (left, right) => left.loadOrder - right.loadOrder,
      )) {
        this.assertCurrent(request, this.activePageRequest);
        pageContext.data[load.alias] = await this.execute(
          "page_collection_load",
          load.collectionId,
          () => this.adapter.loadCollection(
            load,
            pageContext,
            request.controller.signal,
          ),
        );
      }
      await this.emit("page_onload_complete", screenContext, pageContext);

      const pageComponents = this.definition.componentInstances
        .filter(
          (component) =>
            component.placement === "page_panel" && component.pageId === pageId,
        )
        .sort((left, right) => left.loadOrder - right.loadOrder);
      for (const component of pageComponents) {
        this.assertCurrent(request, this.activePageRequest);
        await this.execute(
          "page_component_prepare",
          component.id,
          () => this.adapter.prepareComponent(
            component,
            pageContext,
            request.controller.signal,
          ),
        );
      }
      await this.emit("page_components_complete", screenContext, pageContext);
      this.assertCurrent(request, this.activePageRequest);

      screenContext.currentPageId = pageId;
      screenContext.desiredPageId = undefined;
      this.pageContext = pageContext;
      await this.emit("page_ready", screenContext, pageContext);
      await this.emit("screen_change_page_complete", screenContext, pageContext);
      await this.emit("screen_after_change_page", screenContext, pageContext);
      await this.runSteps(
        "afterChangePage",
        screen.eventSteps,
        screenContext,
        request.controller.signal,
      );
      this.assertCurrent(request, this.activePageRequest);
      return { status: "ready", screen: screenContext, page: pageContext };
    } catch (error) {
      const result = await this.handleFailure(error, "page_onload", pageId, request);
      if (this.activePageRequest === request) {
        screenContext.desiredPageId = undefined;
      }
      if (fromRouteNavigation && result.status === "error") this.pageContext = null;
      return result;
    }
  }

  private createRequest(screenInstanceId: string): ActiveRequest {
    const controller = new AbortController();
    const token: RuntimeRequestToken = {
      requestId: this.idFactory("request"),
      screenInstanceId,
      targetPageInstanceId: this.idFactory("page"),
      cancelled: false,
    };
    return { controller, token };
  }

  private cancelRequest(request: ActiveRequest | null): void {
    if (!request) return;
    request.token.cancelled = true;
    request.controller.abort();
  }

  private assertCurrent(
    request: ActiveRequest,
    current: ActiveRequest | null,
  ): void {
    if (request !== current || request.controller.signal.aborted) {
      throw new CancelledLifecycle();
    }
  }

  private async emit(
    phase: LifecyclePhase,
    screen: ScreenRuntimeContext,
    page?: PageRuntimeContext,
  ): Promise<void> {
    await this.adapter.emit({
      phase,
      routeId: screen.routeId,
      screenId: screen.screenId,
      screenInstanceId: screen.screenInstanceId,
      pageId: page?.pageId,
      pageInstanceId: page?.pageInstanceId,
      requestId: page?.token.requestId ?? screen.token.requestId,
    });
  }

  private async runSteps(
    phase: ScreenEventPhase,
    steps: ScreenEventStepDefinition[],
    context: ScreenRuntimeContext,
    signal: AbortSignal,
  ): Promise<void> {
    for (const step of steps
      .filter((candidate) => candidate.phase === phase)
      .sort((left, right) => left.order - right.order)) {
      if (signal.aborted) throw new CancelledLifecycle();
      await this.execute(SCREEN_STEP_PHASE[phase], step.id, () =>
        this.adapter.runScreenStep(step, context, signal),
      );
    }
  }

  private async execute<T>(
    phase: LifecyclePhase,
    objectId: string,
    operation: () => T | Promise<T>,
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof CancelledLifecycle) throw error;
      throw new LifecycleExecutionFailure(phase, objectId, { cause: error });
    }
  }

  private async handleFailure(
    error: unknown,
    phase: LifecyclePhase,
    objectId: string,
    request: ActiveRequest,
  ): Promise<LifecycleResult> {
    if (error instanceof CancelledLifecycle || request.controller.signal.aborted) {
      return { status: "cancelled" };
    }
    const executionFailure = error instanceof LifecycleExecutionFailure
      ? error
      : null;
    const failure: LifecycleFailure = {
      phase: executionFailure?.phase ?? phase,
      objectId: executionFailure?.objectId ?? objectId,
      requestId: request.token.requestId,
      error: executionFailure?.cause ?? error,
    };
    await this.adapter.onFailure?.(failure);
    return { status: "error", failure };
  }
}
