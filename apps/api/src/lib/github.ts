import axios, { AxiosInstance } from 'axios';
import logger from './logger';

/**
 * Creates an Axios client pre-configured to communicate with the GitHub API
 * using the user's decrypted GitHub OAuth access token.
 */
export const createGithubClient = (token: string): AxiosInstance => {
  const client = axios.create({
    baseURL: 'https://api.github.com',
    headers: {
      'User-Agent': 'Commitra/1.0',
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
    },
  });

  client.interceptors.response.use(
    (response) => {
      const remaining = response.headers['x-ratelimit-remaining'];
      const limit = response.headers['x-ratelimit-limit'];
      
      logger.info(
        { 
          url: response.config.url, 
          status: response.status,
          rateLimitRemaining: remaining,
          rateLimitLimit: limit
        },
        `GitHub API response: rate-limit remaining = ${remaining}/${limit}`
      );
      return response;
    },
    (error) => {
      if (error.response) {
        const { status, data, headers, config } = error.response;
        const remaining = headers['x-ratelimit-remaining'];
        
        logger.error(
          {
            url: config.url,
            status,
            rateLimitRemaining: remaining,
            error: data
          },
          `GitHub API error response: status ${status}`
        );

        if (status === 401) {
          throw new Error('GitHub session expired. Please re-authenticate.');
        } else if (status === 403) {
          if (remaining === '0') {
            throw new Error('GitHub API rate limit exceeded. Please try again later.');
          }
          throw new Error('GitHub access forbidden.');
        } else if (status === 404) {
          throw new Error('Requested GitHub resource not found.');
        }
      } else {
        logger.error({ error: error.message }, 'GitHub API network error');
      }
      return Promise.reject(error);
    }
  );

  return client;
};
export default createGithubClient;
