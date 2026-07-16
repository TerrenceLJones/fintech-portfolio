import { Component, type ErrorInfo, type ReactNode } from 'react';
import { SectionErrorCard } from './SectionErrorCard';

interface SectionErrorBoundaryProps {
  /** The wrapped section's name, forwarded to the fallback card. */
  title: string;
  /** Called when the fallback's Retry is pressed — the page uses it to re-fetch this section's query. */
  onReset?: () => void;
  children: ReactNode;
}

interface SectionErrorBoundaryState {
  hasError: boolean;
}

/**
 * A per-section error boundary (US-CW-015 AC-05). Each dashboard section is wrapped in its own
 * instance so an unexpected render error in one section is caught and shown as the scoped
 * "This section couldn't load. Retry." card, while every sibling section keeps rendering — the
 * failure never cascades to the whole page. Retry clears the boundary and lets the caller re-fetch.
 *
 * Section data-fetch failures (a 500 from the backend) are handled by each section's own query-error
 * branch, which renders the same card; this boundary is the belt-and-braces for a render-time throw.
 */
export class SectionErrorBoundary extends Component<
  SectionErrorBoundaryProps,
  SectionErrorBoundaryState
> {
  state: SectionErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): SectionErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Keep the isolated failure observable in dev without surfacing a stack to the viewer.
    console.error(`Dashboard section "${this.props.title}" crashed:`, error, info.componentStack);
  }

  private handleRetry = () => {
    this.setState({ hasError: false });
    this.props.onReset?.();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return <SectionErrorCard title={this.props.title} onRetry={this.handleRetry} />;
    }
    return this.props.children;
  }
}
