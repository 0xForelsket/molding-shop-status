import { fireEvent, render, screen } from '@testing-library/react';
import { Home } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';
import { TabButton } from './tab-button';

describe('TabButton Component', () => {
  it('renders correctly with label', () => {
    render(<TabButton label="Tab 1" active={false} onClick={() => {}} icon={<Home />} />);
    expect(screen.getByText('Tab 1')).toBeInTheDocument();
  });

  it('applies active styles when active is true', () => {
    render(<TabButton label="Active Tab" active={true} onClick={() => {}} icon={<Home />} />);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('bg-white');
    expect(button).toHaveClass('text-indigo-600');
    expect(button).toHaveClass('shadow-sm');
  });

  it('applies inactive styles when active is false', () => {
    render(<TabButton label="Inactive Tab" active={false} onClick={() => {}} icon={<Home />} />);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('text-slate-500');
    expect(button).not.toHaveClass('bg-white');
  });

  it('calls onClick when clicked', () => {
    const handleClick = vi.fn();
    render(<TabButton label="Click Me" active={false} onClick={handleClick} icon={<Home />} />);

    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
