/** Safe messages cross the server-action boundary; API bodies never do. */
export class SyncRequestError extends Error {
  constructor(message: string, readonly status: number, readonly code: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'SyncRequestError';
  }
}

export async function syncHttpError(response: Response): Promise<SyncRequestError> {
  const payload: unknown = await response.json().catch(() => null);
  const code = payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
    ? payload.error : `http_${response.status}`;
  let message = 'Nie udało się zsynchronizować danych. Spróbuj ponownie później.';
  if (response.status >= 500) message = 'Nie udało się potwierdzić synchronizacji. Odśwież dane i sprawdź wynik przed ponownym zapisem.';
  if (response.status === 400) message = 'Serwer odrzucił dane. Sprawdź konta i pola formularza; automatyczne ponowienie nie naprawi tego błędu.';
  if (response.status === 401) message = 'Sesja wygasła. Zaloguj się ponownie.';
  if (response.status === 403) message = 'Synchronizacja jest niedostępna. Sprawdź uprawnienia i ustawienia synchronizacji.';
  if (response.status === 409) message = code === 'sync_client_upgrade_required'
    ? 'Dane wymagają nowszej wersji Suma. Odśwież aplikację po jej aktualizacji.'
    : 'Stan danych zmienił się na innym urządzeniu. Odśwież dane przed ponownym zapisem.';
  if (response.status === 429) message = 'Zbyt wiele prób synchronizacji. Poczekaj chwilę przed ponownym zapisem.';
  return new SyncRequestError(message, response.status, code);
}
