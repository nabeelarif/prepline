import { StrictMode } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../App';

/** Renders the whole app at an address, the way `main.tsx` does: in StrictMode, with the router at that address. */
export const renderApp = (at = '/') =>
  render(
    <StrictMode>
      <MemoryRouter initialEntries={[at]}>
        <App />
      </MemoryRouter>
    </StrictMode>,
  );
