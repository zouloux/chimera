/**
 * TODO :
 * Un module node à installer en -g qui lance le proxy chimera nginx
 *
 * - chimera-local-proxy start -d ( -d va détacher le process )
 * - chimera-local-proxy stop (arrêter le process qui a été -d )
 *
 * a) Prep
 * 1. Check docker installé + Lien d'install
 * 2. Check mkcert installé + Lien d'install
 * 3. Check docker lancé
 *
 * b) Setup (voir locahost-proxy-start.sh)
 * 1. Git pull du projet ? ( Sinon intégré dans le packet node ça serait + prope )
 * 2. Install le cert
 * 3. Copier la config
 * 4. Démarrer le serveur
 */