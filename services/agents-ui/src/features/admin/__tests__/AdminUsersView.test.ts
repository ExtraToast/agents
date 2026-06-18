import type { PropType, VNode } from 'vue'
import type { AdminUserResponse } from '../types'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { useAdminStore } from '../stores/admin'
import AdminUsersView from '../views/AdminUsersView.vue'

const confirmMock = vi.hoisted(() => ({ require: vi.fn() }))
const toastMock = vi.hoisted(() => ({
  errorFromCatch: vi.fn(),
  success: vi.fn(),
}))

vi.mock('primevue/useconfirm', () => ({
  useConfirm: () => confirmMock,
}))

vi.mock('@/lib/vueWebCommons', () => ({
  useToast: () => toastMock,
}))

function user(overrides: Partial<AdminUserResponse> = {}): AdminUserResponse {
  return {
    id: 'user-1',
    username: 'ada',
    email: 'ada@example.com',
    firstName: 'Ada',
    lastName: 'Lovelace',
    role: 'USER',
    emailConfirmed: true,
    totpEnabled: false,
    servicePermissions: ['agents'],
    createdAt: '2026-06-18T10:00:00Z',
    ...overrides,
  }
}

interface ColumnSlotChildren {
  body?: (props: { data: AdminUserResponse }) => VNode[]
}

interface ColumnProps {
  field?: keyof AdminUserResponse
}

const DataTableStub = defineComponent({
  name: 'DataTable',
  props: {
    loading: { type: Boolean, default: false },
    value: {
      type: Array as PropType<AdminUserResponse[]>, // eslint-disable-line ts/consistent-type-assertions
      default: () => [],
    },
  },
  setup(props, { slots }) {
    return () => {
      if (props.loading) return h('div', { 'data-testid': 'table-loading' }, slots.loading?.())
      if (props.value.length === 0) return h('div', { 'data-testid': 'table-empty' }, slots.empty?.())

      const columns = (slots.default?.() ?? []) as VNode[] // eslint-disable-line ts/consistent-type-assertions
      return h(
        'div',
        { 'data-testid': 'admin-users-table-stub' },
        props.value.map((row) =>
          h(
            'div',
            { 'data-testid': `table-row-${row.id}` },
            columns.map((column, index) => renderColumn(column, row, index)),
          ),
        ),
      )
    }
  },
})

const ColumnStub = defineComponent({
  name: 'Column',
  props: {
    field: { type: String, default: '' },
    header: { type: String, default: '' },
  },
  setup() {
    return () => null
  },
})

const SelectStub = defineComponent({
  name: 'Select',
  inheritAttrs: false,
  props: {
    disabled: { type: Boolean, default: false },
    modelValue: { type: String, required: true },
    options: { type: Array as PropType<string[]>, required: true }, // eslint-disable-line ts/consistent-type-assertions
  },
  emits: ['update:modelValue'],
  setup(props, { attrs, emit }) {
    return () =>
      h(
        'select',
        {
          ...attrs,
          disabled: props.disabled,
          value: props.modelValue,
          onChange: (event: Event) => {
            const target = event.target as HTMLSelectElement // eslint-disable-line ts/consistent-type-assertions
            emit('update:modelValue', target.value)
          },
        },
        props.options.map((option) => h('option', { value: option }, option)),
      )
  },
})

const ButtonStub = defineComponent({
  name: 'Button',
  inheritAttrs: false,
  props: {
    label: { type: String, default: '' },
    loading: { type: Boolean, default: false },
  },
  setup(props, { attrs }) {
    return () => h('button', { ...attrs, disabled: props.loading, type: 'button' }, props.label)
  },
})

const MultiSelectStub = defineComponent({
  name: 'MultiSelect',
  setup() {
    return () => h('div')
  },
})

const ChipStub = defineComponent({
  name: 'Chip',
  props: {
    label: { type: String, required: true },
  },
  emits: ['remove'],
  setup(props, { attrs, emit }) {
    return () =>
      h('span', attrs, [
        props.label,
        h('button', { type: 'button', onClick: () => emit('remove') }, 'remove'),
      ])
  },
})

const globalStubs = {
  Button: ButtonStub,
  Chip: ChipStub,
  Column: ColumnStub,
  ConfirmDialog: { template: '<div />' },
  DataTable: DataTableStub,
  MultiSelect: MultiSelectStub,
  Select: SelectStub,
}

function renderColumn(column: VNode, row: AdminUserResponse, index: number): VNode {
  const children = column.children as ColumnSlotChildren | null // eslint-disable-line ts/consistent-type-assertions
  const props = column.props as ColumnProps | null // eslint-disable-line ts/consistent-type-assertions
  if (children?.body) return h('div', { 'data-testid': `cell-${row.id}-${index}` }, children.body({ data: row }))
  if (props?.field) {
    return h('div', { 'data-testid': `cell-${row.id}-${String(props.field)}` }, String(row[props.field]))
  }
  return h('div')
}

describe('admin users view', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    confirmMock.require.mockReset()
    toastMock.errorFromCatch.mockReset()
    toastMock.success.mockReset()
  })

  it('renders loaded users', async () => {
    const store = useAdminStore()
    vi.spyOn(store, 'listUsers').mockImplementation(async () => {
      store.users = [user()]
      return store.users
    })

    const wrapper = mount(AdminUsersView, { global: { stubs: globalStubs } })
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    expect(wrapper.get('[data-testid="admin-user-user-1"]').text()).toContain('ada')
    expect(wrapper.text()).toContain('ada@example.com')
    expect(wrapper.text()).toContain('agents')
  })

  it('confirms and updates a role change', async () => {
    const store = useAdminStore()
    store.users = [user()]
    vi.spyOn(store, 'listUsers').mockResolvedValue(store.users)
    const updateRole = vi.spyOn(store, 'updateRole').mockImplementation(async (id, role) => {
      const updated = user({ id, role })
      store.users = [updated]
      return updated
    })

    const wrapper = mount(AdminUsersView, { global: { stubs: globalStubs } })
    await wrapper.vm.$nextTick()

    await wrapper.get('[data-testid="admin-role-user-1"]').setValue('ADMIN')
    const request = confirmMock.require.mock.calls[0]?.[0]
    if (request === undefined) throw new TypeError('missing confirm request')
    request.accept()
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    expect(updateRole).toHaveBeenCalledWith('user-1', 'ADMIN')
    expect(toastMock.success).toHaveBeenCalledWith('Role updated', 'Ada Lovelace is now ADMIN.')
  })

  it('updates service permissions', async () => {
    const store = useAdminStore()
    store.users = [user()]
    vi.spyOn(store, 'listUsers').mockResolvedValue(store.users)
    const updateServicePermissions = vi
      .spyOn(store, 'updateServicePermissions')
      .mockImplementation(async (id, services) => {
        const updated = user({ id, servicePermissions: services })
        store.users = [updated]
        return updated
      })

    const wrapper = mount(AdminUsersView, { global: { stubs: globalStubs } })
    await wrapper.vm.$nextTick()

    await wrapper.get('[data-testid="service-permissions-input"]').setValue('billing')
    await wrapper.get('[data-testid="service-permissions-add"]').trigger('click')
    await wrapper.get('[data-testid="service-permissions-save"]').trigger('click')
    await wrapper.vm.$nextTick()

    expect(updateServicePermissions).toHaveBeenCalledWith('user-1', ['agents', 'billing'])
  })

  it('confirms and deletes a user', async () => {
    const store = useAdminStore()
    store.users = [user()]
    vi.spyOn(store, 'listUsers').mockResolvedValue(store.users)
    const deleteUser = vi.spyOn(store, 'deleteUser').mockResolvedValue()

    const wrapper = mount(AdminUsersView, { global: { stubs: globalStubs } })
    await wrapper.vm.$nextTick()

    await wrapper.get('[data-testid="admin-delete-user-1"]').trigger('click')
    const request = confirmMock.require.mock.calls[0]?.[0]
    if (request === undefined) throw new TypeError('missing confirm request')
    request.accept()
    await wrapper.vm.$nextTick()

    expect(deleteUser).toHaveBeenCalledWith('user-1')
  })
})
