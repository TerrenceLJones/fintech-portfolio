import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Container } from './Container';

describe('Container', () => {
  it('renders its children', () => {
    render(
      <Container>
        <div>Page content</div>
      </Container>,
    );
    expect(screen.getByText('Page content')).toBeInTheDocument();
  });

  it('resolves named width tokens to their pixel values', () => {
    const { container } = render(<Container width="sm">content</Container>);
    expect((container.firstChild as HTMLElement).style.maxWidth).toBe('384px');
  });

  it('accepts an exact pixel value for one-off widths', () => {
    const { container } = render(<Container width={960}>content</Container>);
    expect((container.firstChild as HTMLElement).style.maxWidth).toBe('960px');
  });

  it('omits centering when center is false', () => {
    const { container } = render(<Container center={false}>content</Container>);
    expect(container.firstChild).not.toHaveClass('mx-auto');
  });

  it('omits horizontal padding when padded is false', () => {
    const { container } = render(<Container padded={false}>content</Container>);
    expect(container.firstChild).not.toHaveClass('px-8');
  });
});
