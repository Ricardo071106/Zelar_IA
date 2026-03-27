import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

/**
 * Classe base para erros personalizados da aplicação
 */
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Erros específicos
 */
export class NotFoundError extends AppError {
  constructor(resource: string, id?: string | number) {
    super(
      404,
      id ? `${resource} com ID ${id} não encontrado` : `${resource} não encontrado`,
      'RESOURCE_NOT_FOUND',
      { resource, id }
    );
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(400, message, 'VALIDATION_ERROR', details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Não autorizado') {
    super(401, message, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Acesso negado') {
    super(403, message, 'FORBIDDEN');
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: any) {
    super(409, message, 'CONFLICT', details);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(service: string) {
    super(503, `Serviço ${service} indisponível`, 'SERVICE_UNAVAILABLE', { service });
  }
}

/**
 * Middleware de tratamento de erros global
 */
export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Log do erro
  console.error('❌ Erro:', {
    name: error.name,
    message: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
  });

  // Erro de validação Zod
  if (error instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Erro de validação dos dados',
        details: error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
        })),
      },
      timestamp: new Date().toISOString(),
    });
  }

  // Erro personalizado da aplicação
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
      timestamp: new Date().toISOString(),
    });
  }

  // Erro genérico (não esperado)
  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: process.env.NODE_ENV === 'production' 
        ? 'Erro interno do servidor' 
        : error.message,
      ...(process.env.NODE_ENV !== 'production' && { stack: error.stack }),
    },
    timestamp: new Date().toISOString(),
  });
}

/**
 * Middleware para rotas não encontradas
 */
export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `Rota ${req.method} ${req.path} não encontrada`,
      path: req.path,
      method: req.method,
    },
    timestamp: new Date().toISOString(),
  });
}

/**
 * Wrapper para tratamento de erros assíncronos
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
