import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";

export interface ApiResponse<T> {
  data: T;
}

@Injectable()
export class ApiTransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  public intercept(_context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => ({
        data: data === undefined ? null : data,
      })),
    );
  }
}
