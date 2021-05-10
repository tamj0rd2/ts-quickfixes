/* eslint-disable */
class HttpClient {
  constructor(args: { timeout: number; baseUrl: string; operation: string }) {}

  public makeRequest(args: { method: string, endpoint: string }) {}
}

const baseUrl = 'https://www.example.com'
const client = new HttpClient({ timeout: 456 }).makeRequest({})
