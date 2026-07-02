import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { typography } from '@fintech-portfolio/design-tokens';
import { Text } from './Text';

describe('Text', () => {
  it('defaults to body size rendered as a <p>', () => {
    render(<Text>Hello</Text>);
    const el = screen.getByText('Hello');
    expect(el.tagName).toBe('P');
    expect(el).toHaveStyle({ fontSize: `${typography.scale.body.size}px` });
  });

  it.each(Object.keys(typography.scale) as Array<keyof typeof typography.scale>)(
    'renders the %s size at its token-defined font size',
    (size) => {
      render(<Text size={size}>Sized text</Text>);
      const el = screen.getByText('Sized text');
      expect(el).toHaveStyle({ fontSize: `${typography.scale[size].size}px` });
    },
  );

  it('decouples visual size from semantic tag via `as`', () => {
    render(
      <Text size="body" as="h3">
        Small heading
      </Text>,
    );
    expect(screen.getByRole('heading', { level: 3, name: 'Small heading' })).toBeInTheDocument();
  });

  it('lets weight override the size-derived default', () => {
    render(
      <Text size="body" weight="semibold">
        Emphasized
      </Text>,
    );
    expect(screen.getByText('Emphasized')).toHaveClass('font-semibold');
  });

  it('maps tone to the corresponding design token class', () => {
    render(<Text tone="negative">Error copy</Text>);
    expect(screen.getByText('Error copy')).toHaveClass('text-cl-neg');
  });

  it('applies no color class when tone is omitted, so an inherited or custom color can apply', () => {
    render(<Text>Plain copy</Text>);
    const el = screen.getByText('Plain copy');
    expect(el.className).not.toMatch(/text-cl-/);
  });

  it('associates a label element via htmlFor', () => {
    render(
      <>
        <Text as="label" htmlFor="email">
          Email
        </Text>
        <input id="email" />
      </>,
    );
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });
});
