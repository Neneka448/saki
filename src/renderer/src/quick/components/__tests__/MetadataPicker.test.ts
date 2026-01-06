import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MetadataPicker from '../MetadataPicker.vue'

describe('MetadataPicker', () => {
  const defaultProps = {
    modelValue: {},
    disabled: false,
  }

  it('should render metadata picker trigger button', () => {
    const wrapper = mount(MetadataPicker, { props: defaultProps })
    
    const trigger = wrapper.find('.metadata-picker__trigger')
    expect(trigger.exists()).toBe(true)
    expect(trigger.text()).toBe('+ 元信息')
  })

  it('should show count when metadata is present', () => {
    const wrapper = mount(MetadataPicker, {
      props: {
        modelValue: { sourceUrl: 'https://example.com' },
        disabled: false,
      },
    })

    const trigger = wrapper.find('.metadata-picker__trigger')
    expect(trigger.text()).toContain('(1)')
  })

  it('should show both counts when both metadata fields are present', () => {
    const wrapper = mount(MetadataPicker, {
      props: {
        modelValue: {
          sourceUrl: 'https://example.com',
          sourcePath: '/path/to/file',
        },
        disabled: false,
      },
    })

    const trigger = wrapper.find('.metadata-picker__trigger')
    expect(trigger.text()).toContain('(2)')
  })

  it('should display metadata chips when metadata is present', () => {
    const wrapper = mount(MetadataPicker, {
      props: {
        modelValue: {
          sourceUrl: 'https://example.com',
          sourcePath: '/path/to/file',
        },
        disabled: false,
      },
    })

    const chips = wrapper.findAll('.metadata-chip')
    expect(chips.length).toBe(2)
    expect(chips[0].text()).toContain('https://example.com')
    expect(chips[1].text()).toContain('/path/to/file')
  })

  it('should open dropdown when trigger is clicked', async () => {
    const wrapper = mount(MetadataPicker, { props: defaultProps })

    expect(wrapper.find('.metadata-picker__dropdown').exists()).toBe(false)

    await wrapper.find('.metadata-picker__trigger').trigger('click')

    expect(wrapper.find('.metadata-picker__dropdown').exists()).toBe(true)
  })

  it('should show both metadata sections in dropdown', async () => {
    const wrapper = mount(MetadataPicker, { props: defaultProps })

    await wrapper.find('.metadata-picker__trigger').trigger('click')

    const sections = wrapper.findAll('.metadata-picker__section')
    expect(sections.length).toBe(2)
    expect(sections[0].text()).toContain('来源链接')
    expect(sections[1].text()).toContain('文件路径')
  })

  it('should show placeholder when metadata is not set', async () => {
    const wrapper = mount(MetadataPicker, { props: defaultProps })

    await wrapper.find('.metadata-picker__trigger').trigger('click')

    const placeholders = wrapper.findAll('.metadata-picker__placeholder')
    expect(placeholders.length).toBe(2)
    expect(placeholders[0].text()).toBe('未设置')
    expect(placeholders[1].text()).toBe('未设置')
  })

  it('should show values when metadata is set', async () => {
    const wrapper = mount(MetadataPicker, {
      props: {
        modelValue: {
          sourceUrl: 'https://example.com',
          sourcePath: '/src/index.ts',
        },
        disabled: false,
      },
    })

    await wrapper.find('.metadata-picker__trigger').trigger('click')

    const values = wrapper.findAll('.metadata-picker__value')
    expect(values.length).toBe(2)
    expect(values[0].text()).toBe('https://example.com')
    expect(values[1].text()).toBe('/src/index.ts')
  })

  it('should emit update when metadata chip is removed', async () => {
    const wrapper = mount(MetadataPicker, {
      props: {
        modelValue: { sourceUrl: 'https://example.com' },
        disabled: false,
      },
    })

    await wrapper.findAll('.metadata-chip')[0].trigger('click')

    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    const emitted = wrapper.emitted('update:modelValue') as any[]
    expect(emitted[0][0]).toEqual({ sourceUrl: undefined })
  })

  it('should be disabled when disabled prop is true', () => {
    const wrapper = mount(MetadataPicker, {
      props: {
        modelValue: {},
        disabled: true,
      },
    })

    const trigger = wrapper.find('.metadata-picker__trigger')
    expect(trigger.attributes('disabled')).toBeDefined()
  })

  it('should show hint text in dropdown', async () => {
    const wrapper = mount(MetadataPicker, { props: defaultProps })

    await wrapper.find('.metadata-picker__trigger').trigger('click')

    const hint = wrapper.find('.metadata-picker__hint')
    expect(hint.exists()).toBe(true)
    expect(hint.text()).toContain('元信息帮助你记录内容来源')
  })
})
