import { createContext, useContext } from 'react';

/**
 * Lets a page that works without an account ask for the sign-in screen. Signed in, the
 * default does nothing because there is nobody to ask.
 */
export const SignInContext = createContext<() => void>(() => {});
export const useRequestSignIn = () => useContext(SignInContext);
