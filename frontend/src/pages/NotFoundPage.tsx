import React from 'react';
import { ErrorState } from '../components/ui/States';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

export const NotFoundPage: React.FC = () => {
  useDocumentTitle('Page not found');
  return <ErrorState fullPage title="Page not found" message="That page doesn't exist or has moved." backTo="/" backLabel="Go home" />;
};
export default NotFoundPage;
