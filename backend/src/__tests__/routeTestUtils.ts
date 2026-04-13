import type { Request, Response } from "express";

interface RouterLike {
  stack?: Array<{
    route?: {
      path?: string;
      methods?: Record<string, boolean>;
      stack?: Array<{
        handle: (
          req: Request,
          res: Response
        ) => Promise<Response | void> | Response | void;
      }>;
    };
  }>;
}

export function getRouteHandler(
  router: unknown,
  method: string,
  path: string,
  handlerIndex = -1
) {
  const routeLayer = (router as RouterLike).stack?.find(
    (layer) =>
      layer.route?.path === path &&
      layer.route.methods?.[method.toLowerCase()] === true
  );

  if (!routeLayer?.route?.stack?.length) {
    throw new Error(`Could not find ${method.toUpperCase()} ${path}`);
  }

  const handlers = routeLayer.route.stack.map((layer) => layer.handle);
  const resolvedIndex =
    handlerIndex >= 0 ? handlerIndex : Math.max(handlers.length - 1, 0);
  const handler = handlers[resolvedIndex];

  if (!handler) {
    throw new Error(
      `Could not resolve handler ${resolvedIndex} for ${method.toUpperCase()} ${path}`
    );
  }

  return handler as (
    req: Request,
    res: Response
  ) => Promise<Response | void> | Response | void;
}

export function createMockResponse() {
  const response = {
    statusCode: 200,
    body: null as unknown,
    headers: {} as Record<string, string>,
    contentType: null as string | null,
    locals: {} as Record<string, unknown>,
    status(code: number) {
      response.statusCode = code;
      return response;
    },
    setHeader(name: string, value: string) {
      response.headers[name] = value;
      return response;
    },
    getHeader(name: string) {
      return response.headers[name];
    },
    type(value: string) {
      response.contentType = value;
      return response;
    },
    json(payload: unknown) {
      response.body = payload;
      return response;
    },
    send(payload: unknown) {
      response.body = payload;
      return response;
    },
  };

  return response as Response & {
    statusCode: number;
    body: unknown;
    headers: Record<string, string>;
    contentType: string | null;
  };
}
