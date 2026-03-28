import { Routes, Route } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import Home from './pages/Home';
import Search from './pages/Search';
import RecipeDetail from './pages/RecipeDetail';
import MyRecipes from './pages/MyRecipes';
import SavedRecipes from './pages/SavedRecipes';
import Profile from './pages/Profile';
import Login from './pages/Login';
import Register from './pages/Register';
import { Toaster } from 'sonner';

export default function App() {
  return (
    <>
      <Toaster position="top-center" richColors />
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<Search />} />
          <Route path="/recipe/:id" element={<RecipeDetail />} />
          <Route path="/my-recipes" element={<MyRecipes />} />
          <Route path="/saved" element={<SavedRecipes />} />
          <Route path="/profile" element={<Profile />} />
        </Route>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Routes>
    </>
  );
}
