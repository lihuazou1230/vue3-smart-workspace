import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import SearchBar from './SearchBar.vue'

describe('SearchBar', () => {
  it('输入时 v-model 更新', async () => {
    const wrapper = mount(SearchBar, { props: { modelValue: '' } })
    await wrapper.find('input').setValue('周报')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['周报'])
  })

  it('回车触发 enter', async () => {
    const wrapper = mount(SearchBar, { props: { modelValue: 'vue' } })
    await wrapper.find('input').trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('enter')?.[0]).toEqual(['vue'])
  })
})
