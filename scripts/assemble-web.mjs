import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

const repositoryRoot = process.cwd();
const publicRoot = path.join(repositoryRoot, 'services', 'api', 'dist', 'public');
const applications = {
  home: 'home-web',
  company: 'company-web',
  professional: 'professional-web',
  admin: 'admin-web'
};

await rm(publicRoot, { force: true, recursive: true });
await mkdir(publicRoot, { recursive: true });

for (const [name, workspace] of Object.entries(applications)) {
  const destination = path.join(publicRoot, name);
  await cp(
    path.join(repositoryRoot, 'apps', workspace, 'dist'),
    destination,
    { recursive: true }
  );
  await cp(path.join(repositoryRoot, 'apps', 'home-web', 'dist', 'logo.svg'), path.join(destination, 'logo.svg'));
}
