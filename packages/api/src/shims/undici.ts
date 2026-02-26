// Shim for undici - Workers have native fetch, Headers, Request, Response
export const fetch = globalThis.fetch
export const Headers = globalThis.Headers
export const Request = globalThis.Request
export const Response = globalThis.Response
export const FormData = globalThis.FormData
