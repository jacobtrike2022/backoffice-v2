
  import { createRoot } from "react-dom/client";
  import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
  import App from "./App.tsx";
  import "./index.css";
  import "./styles/globals.css";

  // Create a client
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5, // 5 minutes
        retry: 1,
      },
    },
  });

  // Global error handlers to catch unhandled errors and prevent white screens
  window.addEventListener('error', (event) => {
    console.error('Global error caught:', event.error);
    // You could send to error reporting service here
  });

  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    // Prevent default browser error handling
    event.preventDefault();
    // You could send to error reporting service here
  });

  createRoot(document.getElementById("root")!).render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  );
  