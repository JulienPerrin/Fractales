# Fractales

Pages HTML simples qui génèrent des fractales directement dans le navigateur grâce au canvas HTML5 (Mandelbrot CPU/GPU, triangle de Sierpinski).

Démo en ligne : <https://julienperrin.github.io/Fractales/>

## Exemples (Mandelbrot)

![mandelbrot_example_1.png](public/img/mandelbrot_example_1.png)

![mandelbrot_example_2.png](public/img/mandelbrot_example_2.png)

![mandelbrot_wallpaper.png](public/img/mandelbrot_wallpaper.png)

## Développement local

```bash
git clone git@github.com:JulienPerrin/Fractales.git
cd Fractales
npm install
npm run dev
```

Le serveur Vite démarre sur `http://localhost:5175`.

## Scripts

Les sources TypeScript sont dans `src/` et les tests dans `test/`. Vite génère le build statique dans `dist/` (déployé sur GitHub Pages via `.github/workflows/deploy.yml`) :

* `npm run dev` — serveur de développement Vite avec HMR (port `5175`)
* `npm run build` — build de production dans `dist/`
* `npm run preview` — prévisualisation locale du build `dist/` (port `5175`)
* `npm run typecheck` — vérification TypeScript (`tsc --noEmit`)
* `npm test` — exécution des tests unitaires Vitest
* `npm run test:coverage` — tests Vitest avec rapport de couverture

## TODO

* [x] Ajouter un mode « itérations auto » adaptatif selon le niveau de zoom et la position
* [x] Désactiver le champ `#max` lorsque « Itérations auto » est coché
* [x] Deep zoom GPU précision arbitraire (émulation BigDecimal / BigInt + perturbation theory) pour dépasser `float32`/`float64`
* [ ] Zoom continu tant que le clic gauche est maintenu, dézoom au clic droit
* [ ] Ajouter un mode « teinte (hue) auto » et un contrôle pour configurer la teinte
