// The themes /look can switch to. To add one:
//   1. Copy a theme file (forest.ts is a good start) to a new name, e.g. ocean.ts.
//   2. Change its id, name and colors.
//   3. Import it below and add it to the list.
// The first theme in the list is the default.

import aurora from './aurora'
import forest from './forest'
import paper from './paper'
import sandstone from './sandstone'
import type { Theme } from './types'

export const THEMES: Theme[] = [aurora, paper, forest, sandstone]
