import http from 'node:http';

const socketPath = process.env.DOCKER_SOCKET_PATH || '/var/run/docker.sock';

export interface DockerResponse<T = unknown> {
  statusCode: number;
  data: T;
}

export function dockerRequest<T = unknown>(method: string, path: string, body?: unknown): Promise<DockerResponse<T>> {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const request = http.request({
      socketPath,
      path,
      method,
      headers: payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : undefined,
    }, (response) => {
      let text = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { text += chunk; });
      response.on('end', () => {
        let data: unknown = text;
        try { data = text ? JSON.parse(text) : null; } catch { /* Docker can return plain text. */ }
        resolve({ statusCode: response.statusCode || 500, data: data as T });
      });
    });
    request.on('error', reject);
    if (payload) request.write(payload);
    request.end();
  });
}

export async function dockerAvailable(): Promise<boolean> {
  try {
    const response = await dockerRequest('GET', '/_ping');
    return response.statusCode === 200;
  } catch {
    return false;
  }
}
