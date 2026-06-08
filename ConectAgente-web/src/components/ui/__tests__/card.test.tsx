import React from 'react';
import { render, screen } from '@testing-library/react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../card';

describe('Card', () => {
  it('renders children', () => {
    render(<Card><p>Card content</p></Card>);
    expect(screen.getByText('Card content')).toBeInTheDocument();
  });

  it('applies default classes', () => {
    const { container } = render(<Card>Content</Card>);
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('rounded-lg');
    expect(card.className).toContain('border');
    expect(card.className).toContain('bg-white');
  });

  it('applies custom className', () => {
    const { container } = render(<Card className="custom-class">Content</Card>);
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('custom-class');
  });
});

describe('CardHeader', () => {
  it('renders children', () => {
    render(<CardHeader><span>Header</span></CardHeader>);
    expect(screen.getByText('Header')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<CardHeader className="my-header">Header</CardHeader>);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('my-header');
  });
});

describe('CardTitle', () => {
  it('renders as h3 element', () => {
    render(<CardTitle>Title Text</CardTitle>);
    const heading = screen.getByText('Title Text');
    expect(heading.tagName).toBe('H3');
  });

  it('applies text styling classes', () => {
    render(<CardTitle>Title</CardTitle>);
    const heading = screen.getByText('Title');
    expect(heading.className).toContain('font-semibold');
  });
});

describe('CardDescription', () => {
  it('renders as p element', () => {
    render(<CardDescription>Description text</CardDescription>);
    const el = screen.getByText('Description text');
    expect(el.tagName).toBe('P');
  });

  it('applies text styling', () => {
    render(<CardDescription>Desc</CardDescription>);
    const el = screen.getByText('Desc');
    expect(el.className).toContain('text-sm');
    expect(el.className).toContain('text-gray-500');
  });
});

describe('CardContent', () => {
  it('renders children', () => {
    render(<CardContent><div data-testid="inner">Inner content</div></CardContent>);
    expect(screen.getByTestId('inner')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<CardContent className="extra">Content</CardContent>);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('extra');
  });
});

describe('CardFooter', () => {
  it('renders children', () => {
    render(<CardFooter><button>Action</button></CardFooter>);
    expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument();
  });

  it('applies flex layout classes', () => {
    const { container } = render(<CardFooter>Footer</CardFooter>);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('flex');
    expect(el.className).toContain('items-center');
  });
});
