import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WindowFrame } from './WindowFrame';

describe('WindowFrame', () => {
  it('renders the url and its children', () => {
    render(
      <WindowFrame url="app.clearline.com/dashboard">
        <div>Dashboard content</div>
      </WindowFrame>,
    );
    expect(screen.getByText('app.clearline.com/dashboard')).toBeInTheDocument();
    expect(screen.getByText('Dashboard content')).toBeInTheDocument();
  });
});
