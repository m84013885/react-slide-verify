import { createRoot } from 'react-dom/client'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <App
    getUrl='http://localhost:3000/api/slide-challenge'
    checkUrl='http://localhost:3000/api/slide-verify'
    onSuccess={(token) => {
      console.log('验证成功 ✓', token)
    }}
  />
)
