try {
  const vite = await import('vite');
  console.log('vite loaded successfully');
} catch (e) {
  console.error('Vite import error:', e.message);
  console.error(e.stack);
}
