/* Подключение к Supabase.
   Здесь ТОЛЬКО anon-ключ: он рассчитан на использование в браузере,
   все данные защищены политиками Row Level Security на стороне базы.
   Ключ service_role сюда передавать нельзя — он даёт обход всех политик. */
export const SUPABASE_URL = 'https://vuxgkadarbikiftetqwv.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ1eGdrYWRhcmJpa2lmdGV0cXd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQyOTM1MDQsImV4cCI6MjEwOTg2OTUwNH0.AOVMLasMyK0KevQYvg2So_oVi-Ln-taiEeEwlJsEudE';
