import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))

export const pluginRoot = path.resolve(here, '..')
export const configFile = path.join(pluginRoot, 'config', 'config.json')
export const chatlogDir = path.join(pluginRoot, 'chatlog')
export const htmlDir = path.join(pluginRoot, 'resources', 'html')
