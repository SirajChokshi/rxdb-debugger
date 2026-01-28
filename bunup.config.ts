import { defineWorkspace } from 'bunup'

export default defineWorkspace([
	{
		name: 'core',
		root: 'packages/core',
		config: {
			entry: ['src/index.ts'],
			external: ['rxdb', 'rxjs'],
		},
	},
	{
		name: 'chrome-extension',
		root: 'packages/chrome-extension',
		config: {
			entry: ['src/panel.ts'],
			external: ['rxdb', 'rxjs', '@rxdb-debugger/core'],
		},
	},
])
