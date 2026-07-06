import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DocumentDropzone } from './DocumentDropzone';

const file = new File(['fake-bytes'], 'drivers-license-front.jpg', { type: 'image/jpeg' });

describe('DocumentDropzone', () => {
  it('renders the idle drop prompt and format hint', () => {
    render(
      <DocumentDropzone
        label="Dara Reyes — Driver's license"
        status="idle"
        onFileSelected={() => {}}
      />,
    );

    expect(screen.getByText("Dara Reyes — Driver's license")).toBeInTheDocument();
    expect(screen.getByText(/drag & drop/i)).toBeInTheDocument();
    expect(screen.getByText(/JPG, PNG, or PDF/i)).toBeInTheDocument();
  });

  it('calls onFileSelected when a file is chosen via browse', async () => {
    const onFileSelected = vi.fn();
    render(<DocumentDropzone label="ID" status="idle" onFileSelected={onFileSelected} />);

    const input = screen.getByLabelText(/browse/i, { selector: 'input' });
    await userEvent.upload(input, file);

    expect(onFileSelected).toHaveBeenCalledWith(file);
  });

  it('calls onFileSelected when a file is dropped', () => {
    const onFileSelected = vi.fn();
    render(<DocumentDropzone label="ID" status="idle" onFileSelected={onFileSelected} />);

    const dropzone = screen.getByTestId('document-dropzone');
    fireEvent.drop(dropzone, { dataTransfer: { files: [file] } });

    expect(onFileSelected).toHaveBeenCalledWith(file);
  });

  it('shows the quality-check-passed state once accepted', () => {
    render(<DocumentDropzone label="ID" status="accepted" onFileSelected={() => {}} />);
    expect(screen.getByText('Quality check passed')).toBeInTheDocument();
  });

  it('shows the glare coaching copy from US-CW-005 AC-01', () => {
    render(<DocumentDropzone label="ID" status="glare" onFileSelected={() => {}} />);
    expect(
      screen.getByText(
        "We couldn't read your document. Make sure it's well-lit, in focus, and fully in frame.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retake photo/i })).toBeInTheDocument();
  });

  it('shows the blur coaching copy from US-CW-005 AC-02', () => {
    render(<DocumentDropzone label="ID" status="blurry" onFileSelected={() => {}} />);
    expect(screen.getByText('Hold the camera steady and try again.')).toBeInTheDocument();
  });

  it('shows the wrong-type coaching copy from US-CW-005 AC-03', () => {
    render(<DocumentDropzone label="ID" status="wrong_type" onFileSelected={() => {}} />);
    expect(
      screen.getByText(
        "This doesn't look like a valid ID. Please upload a driver's license, passport, or state ID.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /choose a different file/i })).toBeInTheDocument();
  });

  it('lets a quality-rejected capture be retried through the same file input', async () => {
    const onFileSelected = vi.fn();
    render(<DocumentDropzone label="ID" status="glare" onFileSelected={onFileSelected} />);

    const input = screen.getByLabelText(/retake photo/i, { selector: 'input' });
    await userEvent.upload(input, file);

    expect(onFileSelected).toHaveBeenCalledWith(file);
  });
});
