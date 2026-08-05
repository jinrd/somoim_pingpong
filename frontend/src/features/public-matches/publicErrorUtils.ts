import { ClientResponseError } from "pocketbase";

export const getPublicFeatureErrorMessage = (
  error: unknown,
  fallback: string,
): string => {
  if (error instanceof ClientResponseError) {
    return error.response?.message || error.message || fallback;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
};
