import { ComponentNode } from '@/types';

export interface HistoryState {
  nodes: ComponentNode[];
  timestamp: number;
  description: string;
}

export class HistoryStackManager {
  private undoStack: HistoryState[] = [];
  private redoStack: HistoryState[] = [];
  private maxHistory: number = 30;

  constructor(initialNodes: ComponentNode[]) {
    this.pushState(initialNodes, 'Initial Layout State');
  }

  public pushState(nodes: ComponentNode[], description: string = 'Update AST'): void {
    // Clone nodes deep
    const stateCopy: ComponentNode[] = JSON.parse(JSON.stringify(nodes));
    
    this.undoStack.push({
      nodes: stateCopy,
      timestamp: Date.now(),
      description,
    });

    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }

    // Clear redo stack on new action
    this.redoStack = [];
  }

  public canUndo(): boolean {
    return this.undoStack.length > 1;
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  public undo(): ComponentNode[] | null {
    if (!this.canUndo()) return null;

    // Pop current state onto redo stack
    const currentState = this.undoStack.pop();
    if (currentState) {
      this.redoStack.push(currentState);
    }

    // Return previous state
    const previousState = this.undoStack[this.undoStack.length - 1];
    return previousState ? JSON.parse(JSON.stringify(previousState.nodes)) : null;
  }

  public redo(): ComponentNode[] | null {
    if (!this.canRedo()) return null;

    const nextState = this.redoStack.pop();
    if (nextState) {
      this.undoStack.push(nextState);
      return JSON.parse(JSON.stringify(nextState.nodes));
    }

    return null;
  }

  public getUndoCount(): number {
    return Math.max(0, this.undoStack.length - 1);
  }

  public getRedoCount(): number {
    return this.redoStack.length;
  }
}
