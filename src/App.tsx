import { AppErrorBoundary } from './app/AppErrorBoundary';
import { AppRouter } from './app/AppRouter';
import { AuthProvider } from './app/AuthProvider';
import { ShopProvider } from './app/ShopProvider';
import { ThemeProvider } from './app/ThemeProvider';
import { ToastProvider } from './shared/ui/ToastProvider';

export function App() {
  return (
    <AppErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <ShopProvider>
              <AppRouter />
            </ShopProvider>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </AppErrorBoundary>
  );
}

export default App;
