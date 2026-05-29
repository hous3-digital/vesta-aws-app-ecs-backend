import { SetMetadata } from "@nestjs/common";

export const PUBLIC_ENDPOINT_KEY = "isPublicEndpoint";

/**
 * Marca um controller ou handler como publico, dispensando a validacao de API key.
 * Usar apenas em endpoints que realmente nao precisam de autenticacao (ex: health check).
 */
export const PublicEndpoint = () => SetMetadata(PUBLIC_ENDPOINT_KEY, true);
