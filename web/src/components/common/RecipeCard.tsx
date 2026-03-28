import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Clock, Users, Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';

interface RecipeCardProps {
  recipe: {
    id: string;
    title: string;
    description?: string;
    imageUrl?: string;
    prepTime?: number;
    cookTime?: number;
    servings?: number;
    difficulty?: string;
    cuisine?: string;
    isAiGenerated?: boolean;
  };
}

const difficultyColors: Record<string, string> = {
  EASY: 'bg-green-100 text-green-700',
  MEDIUM: 'bg-yellow-100 text-yellow-700',
  HARD: 'bg-red-100 text-red-700',
};

export default function RecipeCard({ recipe }: RecipeCardProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0);

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.2 }}
      onClick={() => navigate(`/recipe/${recipe.id}`)}
      className="glass-card overflow-hidden cursor-pointer"
    >
      <div className="aspect-video relative bg-gradient-to-br from-primary-100 to-accent-100">
        {recipe.imageUrl ? (
          <img src={recipe.imageUrl} alt={recipe.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-primary-300">
            <Sparkles size={40} />
          </div>
        )}
        {recipe.isAiGenerated && (
          <span className="absolute top-2 start-2 bg-accent/90 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
            <Sparkles size={12} />
            AI
          </span>
        )}
      </div>

      <div className="p-4">
        <h3 className="font-semibold text-stone-800 line-clamp-1">{recipe.title}</h3>
        {recipe.description && (
          <p className="text-sm text-stone-500 mt-1 line-clamp-2">{recipe.description}</p>
        )}

        <div className="flex items-center gap-3 mt-3 text-xs text-stone-500">
          {totalTime > 0 && (
            <span className="flex items-center gap-1">
              <Clock size={14} />
              {totalTime} {t('recipe.minutes')}
            </span>
          )}
          {recipe.servings && (
            <span className="flex items-center gap-1">
              <Users size={14} />
              {recipe.servings}
            </span>
          )}
          {recipe.difficulty && (
            <span className={cn('px-2 py-0.5 rounded-full text-xs', difficultyColors[recipe.difficulty])}>
              {t(`recipe.${recipe.difficulty.toLowerCase()}`)}
            </span>
          )}
          {recipe.cuisine && (
            <span className="px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">{recipe.cuisine}</span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
