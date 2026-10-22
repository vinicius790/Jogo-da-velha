// Fonte única da versão: o campo "version" do package.json.
import pkg from '../../package.json' with { type: 'json' };

export const VERSION = pkg.version;
