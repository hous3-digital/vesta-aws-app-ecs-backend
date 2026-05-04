import { HttpService as AxiosService } from "@nestjs/axios";
import { Injectable } from "@nestjs/common";
import { EgressLogger, EgressRequest, EgressResponse } from "@src/infra/logging/egress/infra/egress.logger";
import { AxiosError, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { firstValueFrom } from "rxjs";

@Injectable()
export class EgressService {
  public constructor(
    private readonly axiosService: AxiosService,
    private readonly egressLogger: EgressLogger,
  ) {
    this.axiosService.axiosRef.interceptors.request.use(this.onRequest, this.onRequestError);
    this.axiosService.axiosRef.interceptors.response.use(this.onResponse, this.onResponseError);
  }

  private readonly onRequest = (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
    return config;
  };

  private readonly onRequestError = async (error: AxiosError): Promise<never> => {
    throw error;
  };

  private readonly onResponse = async (axiosResponse: AxiosResponse): Promise<AxiosResponse> => {
    const request: EgressRequest = {
      method: axiosResponse.request.method,
      protocol: axiosResponse.request.protocol,
      host: axiosResponse.request.host,
      path: axiosResponse.request.path,
    };

    const response: EgressResponse = {
      status: axiosResponse.status,
      data: axiosResponse.data,
    };

    await this.egressLogger.log(request, response);

    return axiosResponse;
  };

  private readonly onResponseError = async (error: AxiosError): Promise<never> => {
    if (error.response) {
      const axiosErrorResponse = error.response;

      const request: EgressRequest = {
        method: axiosErrorResponse.request.method,
        protocol: axiosErrorResponse.request.protocol,
        host: axiosErrorResponse.request.host,
        path: axiosErrorResponse.request.path,
      };

      const response: EgressResponse = {
        status: axiosErrorResponse.status,
        data: axiosErrorResponse.data,
      };

      await this.egressLogger.log(request, response);
    }

    throw error;
  };

  public async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await firstValueFrom(this.axiosService.get<T>(url, config));
    return response.data;
  }

  public async delete(url: string, payload?: any, config?: AxiosRequestConfig) {
    return firstValueFrom(this.axiosService.delete(url, { data: payload, ...config }));
  }

  public async post<T = any>(url: string, payload: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await firstValueFrom(this.axiosService.post<T>(url, payload, config));
    return response.data;
  }

  public async put(url: string, payload: any, config?: any) {
    return firstValueFrom(this.axiosService.put(url, payload, config));
  }

  public async patch(url: string, payload: any, config?: any) {
    return firstValueFrom(this.axiosService.patch(url, payload, config));
  }
}
