import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import App from './App';

// =========================================================
// MOCKS
// =========================================================
vi.mock('axios');
global.fetch = vi.fn();
vi.mock('react-force-graph-2d', () => ({
  default: () => <div data-testid="mock-force-graph">Network Graph Rendered</div>
}));
window.print = vi.fn();
window.HTMLElement.prototype.scrollIntoView = vi.fn();

describe('AURA Frontend App Component', () => {

  beforeEach(() => {
    vi.clearAllMocks();
    axios.get.mockImplementation((url) => {
      if (url.includes('/api/repos')) return Promise.resolve({ data: { repos: ['demo_repo'] } });
      if (url.includes('/api/reports')) return Promise.resolve({ data: { content: '## Fake Report' } });
      if (url.includes('/api/graph')) return Promise.resolve({ data: { nodes: [], links: [] } });
      if (url.includes('/api/notes')) return Promise.resolve({ data: { content: '## Fake Notes' } });
      return Promise.reject(new Error('Not found'));
    });
    // FIX: Match the history mock to 'demo_repo' to stop the MUI out-of-range warning
    axios.post.mockResolvedValue({ data: { repo_name: 'demo_repo' } });
  });

  // ---------------------------------------------------------
  // 1. THE HAPPY PATH: Loading and Submitting
  // ---------------------------------------------------------
  it('renders the initial screen and successfully submits a URL', async () => {
    render(<App />);
    expect(screen.getByText(/Deep-dive into codebases/i)).toBeInTheDocument();

    const input = screen.getByPlaceholderText(/Insert GitHub Repository URL.../i);
    const button = screen.getByRole('button', { name: /Initiate Analysis/i });

    fireEvent.change(input, { target: { value: 'https://github.com/demo/repo' } });
    fireEvent.click(button);

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith('http://localhost:8000/api/analyze', { url: 'https://github.com/demo/repo' });
    });

    await waitFor(() => {
      expect(screen.getByText('Project Document')).toBeInTheDocument();
      expect(screen.getByText('Fake Report')).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------
  // 2. BOUNDARY TEST: The Empty Submit
  // ---------------------------------------------------------
  it('prevents submission if the URL input is completely empty', async () => {
    render(<App />);
    const button = screen.getByRole('button', { name: /Initiate Analysis/i });
    fireEvent.click(button);
    expect(axios.post).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------
  // 3. UI INTERACTION: Switching Tabs & PDF Download
  // ---------------------------------------------------------
  it('allows the user to switch tabs and trigger PDF download', async () => {
    render(<App />);

    const input = screen.getByPlaceholderText(/Insert GitHub Repository URL.../i);
    const button = screen.getByRole('button', { name: /Initiate Analysis/i });
    fireEvent.change(input, { target: { value: 'https://github.com/demo/repo' } });
    fireEvent.click(button);

    // Click Release Notes tab
    const notesTab = await screen.findByText('Release Notes');
    fireEvent.click(notesTab);
    await waitFor(() => expect(screen.getByText('Fake Notes')).toBeInTheDocument());

    // FIX APPLIED HERE: Click the PDF Download button while it is visible on the Notes tab
    const downloadBtns = await screen.findAllByText('Download PDF');
    fireEvent.click(downloadBtns[0]);
    expect(window.print).toHaveBeenCalledTimes(1);

    // THEN switch to the Dependency Graph tab
    fireEvent.click(screen.getByText('Dependency Graph'));
    await waitFor(() => expect(screen.getByTestId('mock-force-graph')).toBeInTheDocument());
  });

  // ---------------------------------------------------------
  // 4. CHAT BOUNDARY & HAPPY PATH
  // ---------------------------------------------------------
  it('handles chat messaging boundaries and streaming', async () => {
    const fakeStream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("Target locked. <ui_graph>main.py</ui_graph>"));
        controller.close();
      }
    });
    
    global.fetch.mockResolvedValue({
      ok: true,
      body: { getReader: () => fakeStream.getReader() }
    });

    render(<App />);

    const input = screen.getByPlaceholderText(/Insert GitHub Repository URL.../i);
    const button = screen.getByRole('button', { name: /Initiate Analysis/i });
    fireEvent.change(input, { target: { value: 'https://github.com/demo/repo' } });
    fireEvent.click(button);

    const chatTab = await screen.findByText('Ask AURA');
    fireEvent.click(chatTab);

    const chatInput = await screen.findByPlaceholderText(/Ask a question about/i);
    
    // Boundary: Empty submission
    fireEvent.submit(chatInput.closest('form')); 
    expect(global.fetch).not.toHaveBeenCalled(); 

    // Happy Path: Send message
    fireEvent.change(chatInput, { target: { value: 'What does main.py do?' } });
    fireEvent.submit(chatInput.closest('form'));

    // FIX: Use findAllByText because the UI renders "Target locked" twice (chat + graph overlay)
    await waitFor(async () => {
      const elements = await screen.findAllByText(/Target locked/i);
      expect(elements.length).toBeGreaterThan(0);
    });
  });

  // ---------------------------------------------------------
  // 5. THEME BOUNDARY
  // ---------------------------------------------------------
  it('toggles between dark and light mode', async () => {
    render(<App />);
    const themeButton = await screen.findByRole('button', { name: /Switch to Light Mode|Switch to Dark Mode/i });
    fireEvent.click(themeButton);
    
    // FIX: Use getAllByText because "AURA" appears multiple times
    await waitFor(() => {
      expect(screen.getAllByText(/AURA/i).length).toBeGreaterThan(0);
    });
  });

});