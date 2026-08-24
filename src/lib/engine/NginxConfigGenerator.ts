import { AppConfig } from '@/types';

/**
 * Generates an Nginx Reverse Proxy configuration block for mapping Subdomain names to Container Host Ports.
 */
export function generateNginxConfig(motherPort: number = 33000, childApps: AppConfig[] = []): string {
  let config = `# Auto-generated Nginx Subdomain Reverse Proxy Configuration
events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    # App แม่ (Studio Control Plane) - Port :${motherPort}
    server {
        listen 80;
        server_name studio.mydomain.com studio.localhost;

        location / {
            proxy_pass http://host.docker.internal:${motherPort};
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }
    }
`;

  // Append server block for each child app container
  childApps.forEach((app) => {
    config += `
    # Child App: ${app.appName} (${app.appSlug}) - Port :${app.port}
    server {
        listen 80;
        server_name ${app.subdomain} ${app.appSlug}.localhost;

        location / {
            proxy_pass http://host.docker.internal:${app.port};
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Tenant-DB ${app.tenantDbName};
        }
    }
`;
  });

  config += `}\n`;
  return config;
}
