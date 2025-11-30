# Deploy

Realiza commit, push y deploy de los cambios actuales.

## Pasos

1. Ejecuta `git status` para ver los archivos modificados
2. Ejecuta `git diff` para ver los cambios realizados
3. Ejecuta `git log --oneline -3` para ver el estilo de los commits recientes
4. Agrega los archivos relevantes con `git add` (excluye archivos de cache como `.firebase/`)
5. Crea un commit con un mensaje descriptivo siguiendo el estilo del proyecto
6. Ejecuta `git push` para subir los cambios a GitHub
7. Ejecuta `npm run build` para verificar que el build pase
8. Ejecuta `firebase deploy --only hosting` para desplegar a Firebase
9. Reporta el resultado con la URL del deploy
