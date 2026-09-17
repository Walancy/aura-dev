import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { exec } from 'node:child_process';

export interface ExtensionManifest {
  name: string;
  displayName?: string;
  version: string;
  description?: string;
  publisher?: string;
  contributes?: {
    themes?: Array<{
      label: string;
      uiTheme: 'vs' | 'vs-dark' | 'hc-black';
      path: string;
    }>;
    iconThemes?: Array<{
      id: string;
      label: string;
      path: string;
    }>;
    snippets?: Array<{
      language: string;
      path: string;
    }>;
    commands?: Array<{
      command: string;
      title: string;
      category?: string;
    }>;
    configuration?: any;
    languages?: any[];
  };
}

export interface InstalledExtensionRecord {
  namespace: string;
  name: string;
  version: string;
  displayName: string;
  description: string;
  iconUrl?: string;
  installedAt: string;
  enabled: boolean;
  folderPath: string;
  contributes?: ExtensionManifest['contributes'];
  themes?: Array<{
    label: string;
    uiTheme: string;
    data: any;
  }>;
  snippets?: Array<{
    language: string;
    data: any;
  }>;
}

class ExtensionsService {
  private baseDir: string;
  private installedFile: string;

  constructor() {
    this.baseDir = path.join(os.homedir(), '.devflow', 'extensions');
    this.installedFile = path.join(this.baseDir, 'installed.json');
    this.ensureDirs();
  }

  private ensureDirs() {
    try {
      if (!fs.existsSync(this.baseDir)) {
        fs.mkdirSync(this.baseDir, { recursive: true });
      }
      if (!fs.existsSync(this.installedFile)) {
        fs.writeFileSync(this.installedFile, JSON.stringify([], null, 2), 'utf8');
      }
    } catch (err) {
      console.warn('[ExtensionsService] Error ensuring dirs:', err);
    }
  }

  // 1. Search Open VSX Registry
  public async search(query = '', size = 35, category = '') {
    try {
      let url = `https://open-vsx.org/api/-/search?size=${size}`;
      if (query && query.trim()) {
        url += `&query=${encodeURIComponent(query.trim())}`;
      } else {
        url += `&sortBy=downloadCount&sortOrder=desc`;
      }
      if (category && category.trim()) {
        url += `&category=${encodeURIComponent(category.trim())}`;
      }

      const resp = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 DevFlow-Desktop/1.0',
        },
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      return {
        success: true,
        extensions: (data.extensions || []).map((e: any) => ({
          namespace: e.namespace,
          name: e.name,
          version: e.version,
          displayName: e.displayName || e.name,
          description: e.description || '',
          downloadCount: e.downloadCount || 0,
          averageRating: e.averageRating || 5,
          reviewCount: e.reviewCount || 0,
          iconUrl: e.files?.icon || null,
          verified: e.verified || false,
          categories: e.categories || [],
          repository: e.repository || '',
          license: e.license || 'MIT',
        })),
        totalSize: data.totalSize || 0,
      };
    } catch (err: any) {
      console.warn('[ExtensionsService] Search failed:', err.message);
      return { success: false, error: err.message, extensions: [] };
    }
  }

  // 2. Fetch Detailed Metadata, README and Manifest
  public async getDetails(namespace: string, name: string) {
    try {
      const url = `https://open-vsx.org/api/${namespace}/${name}/latest`;
      const resp = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 DevFlow-Desktop/1.0',
        },
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const ext = await resp.json();

      let readme = '';
      if (ext.files?.readme) {
        try {
          const rResp = await fetch(ext.files.readme, {
            headers: { 'User-Agent': 'Mozilla/5.0 DevFlow-Desktop/1.0' },
          });
          if (rResp.ok) readme = await rResp.text();
        } catch {}
      }

      let changelog = '';
      if (ext.files?.changelog) {
        try {
          const cResp = await fetch(ext.files.changelog, {
            headers: { 'User-Agent': 'Mozilla/5.0 DevFlow-Desktop/1.0' },
          });
          if (cResp.ok) changelog = await cResp.text();
        } catch {}
      }

      let manifest: ExtensionManifest | null = null;
      if (ext.files?.manifest) {
        try {
          const mResp = await fetch(ext.files.manifest, {
            headers: { 'User-Agent': 'Mozilla/5.0 DevFlow-Desktop/1.0' },
          });
          if (mResp.ok) manifest = await mResp.json();
        } catch {}
      }

      return {
        success: true,
        details: {
          namespace: ext.namespace,
          name: ext.name,
          version: ext.version,
          displayName: ext.displayName || ext.name,
          description: ext.description || '',
          downloadCount: ext.downloadCount || 0,
          averageRating: ext.averageRating || 5,
          reviewCount: ext.reviewCount || 0,
          iconUrl: ext.files?.icon || null,
          verified: ext.verified || false,
          categories: ext.categories || [],
          repository: ext.repository || '',
          homepage: ext.homepage || '',
          license: ext.license || 'MIT',
          readme,
          changelog,
          contributes: manifest?.contributes || {},
          files: ext.files || {},
        },
      };
    } catch (err: any) {
      console.warn('[ExtensionsService] getDetails failed:', err.message);
      return { success: false, error: err.message, details: null };
    }
  }

  // 3. Install Extension: Download VSIX, extract, parse themes/snippets and cache
  public async install(namespace: string, name: string, version?: string) {
    this.ensureDirs();
    try {
      // Fetch latest metadata to get download URL
      const infoUrl = `https://open-vsx.org/api/${namespace}/${name}/${version || 'latest'}`;
      const metaResp = await fetch(infoUrl, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0 DevFlow-Desktop/1.0' },
      });
      if (!metaResp.ok) throw new Error(`Falha ao buscar extensão na Open VSX (${metaResp.status})`);
      const meta = await metaResp.json();

      const resolvedVer = meta.version || version || '1.0.0';
      const targetFolder = path.join(this.baseDir, `${namespace}.${name}-${resolvedVer}`);
      const downloadUrl = meta.files?.download;

      if (!downloadUrl) throw new Error('URL de download da extensão não encontrada');

      // Download VSIX buffer
      const vsixResp = await fetch(downloadUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 DevFlow-Desktop/1.0' },
      });
      if (!vsixResp.ok) throw new Error(`Download do VSIX falhou (${vsixResp.status})`);
      const arrayBuffer = await vsixResp.arrayBuffer();

      const tmpVsix = path.join(this.baseDir, `temp-${Date.now()}.vsix`);
      fs.writeFileSync(tmpVsix, Buffer.from(arrayBuffer));

      // Extract VSIX using system unzip
      if (fs.existsSync(targetFolder)) {
        fs.rmSync(targetFolder, { recursive: true, force: true });
      }
      fs.mkdirSync(targetFolder, { recursive: true });

      await new Promise<void>((resolve, reject) => {
        exec(`unzip -qo "${tmpVsix}" -d "${targetFolder}"`, (err) => {
          try { fs.unlinkSync(tmpVsix); } catch {}
          if (err) reject(err);
          else resolve();
        });
      });

      // Read package.json
      const pkgJsonPath = path.join(targetFolder, 'extension', 'package.json');
      let manifest: ExtensionManifest | null = null;
      if (fs.existsSync(pkgJsonPath)) {
        try {
          manifest = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
        } catch {}
      }

      // Parse Contributed Themes
      const themes: Array<{ label: string; uiTheme: string; data: any }> = [];
      if (manifest?.contributes?.themes) {
        for (const t of manifest.contributes.themes) {
          const cleanPath = t.path.replace(/^\.\//, '');
          const themeFile = path.join(targetFolder, 'extension', cleanPath);
          if (fs.existsSync(themeFile)) {
            try {
              const themeContent = fs.readFileSync(themeFile, 'utf8');
              // Strip JSON comments if present
              const stripped = themeContent.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
              const themeData = JSON.parse(stripped);
              themes.push({
                label: t.label,
                uiTheme: t.uiTheme || 'vs-dark',
                data: themeData,
              });
            } catch (err: any) {
              console.warn('[ExtensionsService] Parse theme error:', t.path, err.message);
            }
          }
        }
      }

      // Parse Contributed Snippets
      const snippets: Array<{ language: string; data: any }> = [];
      if (manifest?.contributes?.snippets) {
        for (const s of manifest.contributes.snippets) {
          const cleanPath = s.path.replace(/^\.\//, '');
          const snipFile = path.join(targetFolder, 'extension', cleanPath);
          if (fs.existsSync(snipFile)) {
            try {
              const snipContent = fs.readFileSync(snipFile, 'utf8');
              const stripped = snipContent.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
              const snipData = JSON.parse(stripped);
              snippets.push({
                language: s.language,
                data: snipData,
              });
            } catch {}
          }
        }
      }

      // Save to installed.json
      const record: InstalledExtensionRecord = {
        namespace,
        name,
        version: resolvedVer,
        displayName: meta.displayName || manifest?.displayName || name,
        description: meta.description || manifest?.description || '',
        iconUrl: meta.files?.icon || null,
        installedAt: new Date().toLocaleDateString('pt-BR'),
        enabled: true,
        folderPath: targetFolder,
        contributes: manifest?.contributes || {},
        themes,
        snippets,
      };

      const installed = this.getInstalledInternal();
      const filtered = installed.filter((i) => !(i.namespace === namespace && i.name === name));
      filtered.push(record);
      fs.writeFileSync(this.installedFile, JSON.stringify(filtered, null, 2), 'utf8');

      return {
        success: true,
        record,
      };
    } catch (err: any) {
      console.error('[ExtensionsService] Install failed:', err);
      return { success: false, error: err?.message || String(err) };
    }
  }

  // 4. Uninstall Extension
  public async uninstall(namespace: string, name: string) {
    this.ensureDirs();
    try {
      const installed = this.getInstalledInternal();
      const target = installed.find((i) => i.namespace === namespace && i.name === name);
      if (target?.folderPath && fs.existsSync(target.folderPath)) {
        fs.rmSync(target.folderPath, { recursive: true, force: true });
      }
      const updated = installed.filter((i) => !(i.namespace === namespace && i.name === name));
      fs.writeFileSync(this.installedFile, JSON.stringify(updated, null, 2), 'utf8');
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  // 5. Toggle Enable / Disable
  public async toggleEnabled(namespace: string, name: string) {
    this.ensureDirs();
    try {
      const installed = this.getInstalledInternal();
      const updated = installed.map((i) => {
        if (i.namespace === namespace && i.name === name) {
          return { ...i, enabled: !i.enabled };
        }
        return i;
      });
      fs.writeFileSync(this.installedFile, JSON.stringify(updated, null, 2), 'utf8');
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  // 6. Get List of Installed Extensions
  public getInstalled() {
    this.ensureDirs();
    return { success: true, extensions: this.getInstalledInternal() };
  }

  private getInstalledInternal(): InstalledExtensionRecord[] {
    try {
      if (fs.existsSync(this.installedFile)) {
        return JSON.parse(fs.readFileSync(this.installedFile, 'utf8')) || [];
      }
    } catch {}
    return [];
  }
}

export const extensionsService = new ExtensionsService();
