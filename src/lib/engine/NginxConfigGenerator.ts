import type { SiteRecord } from '@/lib/runtime/siteRegistry';

export interface NginxOptions {
  /** Host/port the control plane listens on, as seen from Nginx. */
  studioUpstream?: string;
  /** Hostnames that reach the studio. */
  studioServerNames?: string[];
  /** Host that site processes run on, as seen from Nginx (compose service name). */
  sitesHost?: string;
}

const PROXY_HEADERS = `            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_read_timeout 60s;`;

/**
 * Builds an Nginx reverse-proxy config from the live site registry.
 *
 * Every domain registered for a site is mapped onto that site's port, so
 * multi-domain hosting works without hand-editing nginx.conf.
 */
export function generateNginxConfig(sites: SiteRecord[], options: NginxOptions = {}): string {
  const studioUpstream = options.studioUpstream ?? 'studio-mother:33000';
  const studioNames = options.studioServerNames ?? ['studio.localhost', 'localhost'];
  const sitesHost = options.sitesHost ?? 'sites';

  const siteBlocks = sites
    .filter((site) => site.isActive)
    .map((site) => {
      const names = [...new Set([...site.domains, site.subdomain, `${site.appSlug}.localhost`])]
        .filter(Boolean)
        .join(' ');

      return `
    # ${site.appName} (${site.appSlug}) -> ${sitesHost}:${site.port}
    server {
        listen 80;
        server_name ${names};

        location / {
            proxy_pass http://${sitesHost}:${site.port};
${PROXY_HEADERS}
        }
    }
`;
    })
    .join('');

  return `# Auto-generated from public.site_registry — do not edit by hand.
# Regenerate: GET /api/nginx-config (SUPER_ADMIN)
events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    client_max_body_size 20m;
    server_tokens off;

    # Unknown hosts get a flat 404 instead of falling through to a real site.
    server {
        listen 80 default_server;
        server_name _;
        return 404;
    }

    # Control plane (DesignMode Studio)
    server {
        listen 80;
        server_name ${studioNames.join(' ')};

        location / {
            proxy_pass http://${studioUpstream};
${PROXY_HEADERS}
        }
    }
${siteBlocks}}
`;
}
