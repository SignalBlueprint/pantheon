import { GameMap } from '../components/map/GameMap';

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center p-8">
      <header className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-2">Pantheon</h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">
          A persistent world deity game. Guide your civilization through policy and miracles.
        </p>
      </header>

      <GameMap />
    </main>
  );
}
