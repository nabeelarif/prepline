import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../App';

/** Renders the whole app at an address, the way `main.tsx` does with the browser's. */
export const renderApp = (at = '/') =>
  render(
    <MemoryRouter initialEntries={[at]}>
      <App />
    </MemoryRouter>,
  );
