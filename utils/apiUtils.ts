type RetryOptions = {
    maxRetries: number;
    initialDelay: number; // in milliseconds
    maxDelay?: number; // optional, to cap the delay
};
  
export async function retryWithExponentialBackoff<T>(
    apiCall: () => Promise<T>,
    { maxRetries, initialDelay, maxDelay }: RetryOptions
): Promise<T | null> {
    let attempt = 0;
    let delay = initialDelay;
  
    while (attempt < maxRetries) {
      try {
        return await apiCall();
      } catch (error) {
        attempt++;
        if (attempt >= maxRetries) {
          console.error('Max retries reached. Giving up.');
          return null;
        }
  
        console.warn(`Attempt ${attempt} failed. Retrying in ${delay} ms...`, error);
  
        await new Promise((resolve) => setTimeout(resolve, delay));
  
        delay = Math.min(delay * 2, maxDelay || delay * 2); // Exponential backoff
      }
    }
    return null;
}
  