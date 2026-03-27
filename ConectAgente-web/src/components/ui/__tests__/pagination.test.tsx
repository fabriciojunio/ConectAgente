import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Pagination } from '../pagination';

describe('Pagination', () => {
  it('renders page numbers correctly', () => {
    render(<Pagination currentPage={1} totalPages={5} onPageChange={jest.fn()} />);
    expect(screen.getByLabelText('Pagina 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Pagina 5')).toBeInTheDocument();
  });

  it('calls onPageChange when clicking a page number', () => {
    const handleChange = jest.fn();
    render(<Pagination currentPage={1} totalPages={5} onPageChange={handleChange} />);
    fireEvent.click(screen.getByLabelText('Pagina 3'));
    expect(handleChange).toHaveBeenCalledWith(3);
  });

  it('disables previous button on first page', () => {
    render(<Pagination currentPage={1} totalPages={5} onPageChange={jest.fn()} />);
    const prevButton = screen.getByLabelText('Pagina anterior');
    expect(prevButton).toBeDisabled();
  });

  it('disables next button on last page', () => {
    render(<Pagination currentPage={5} totalPages={5} onPageChange={jest.fn()} />);
    const nextButton = screen.getByLabelText('Proxima pagina');
    expect(nextButton).toBeDisabled();
  });

  it('shows ellipsis for many pages', () => {
    render(<Pagination currentPage={5} totalPages={10} onPageChange={jest.fn()} />);
    const ellipses = screen.getAllByText('...');
    expect(ellipses.length).toBeGreaterThan(0);
  });

  it('shows correct "Pagina X de Y" text', () => {
    render(<Pagination currentPage={3} totalPages={7} onPageChange={jest.fn()} />);
    expect(screen.getByText('Pagina 3 de 7')).toBeInTheDocument();
  });

  it('calls onPageChange with previous page when clicking previous', () => {
    const handleChange = jest.fn();
    render(<Pagination currentPage={3} totalPages={5} onPageChange={handleChange} />);
    fireEvent.click(screen.getByLabelText('Pagina anterior'));
    expect(handleChange).toHaveBeenCalledWith(2);
  });

  it('calls onPageChange with next page when clicking next', () => {
    const handleChange = jest.fn();
    render(<Pagination currentPage={3} totalPages={5} onPageChange={handleChange} />);
    fireEvent.click(screen.getByLabelText('Proxima pagina'));
    expect(handleChange).toHaveBeenCalledWith(4);
  });

  it('returns null when totalPages is 1', () => {
    const { container } = render(<Pagination currentPage={1} totalPages={1} onPageChange={jest.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('marks current page with aria-current', () => {
    render(<Pagination currentPage={2} totalPages={5} onPageChange={jest.fn()} />);
    const currentButton = screen.getByLabelText('Pagina 2');
    expect(currentButton).toHaveAttribute('aria-current', 'page');
  });
});
