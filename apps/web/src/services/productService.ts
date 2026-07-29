import 'server-only'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'

export type CreateProductInput = {
  ProductName: string
  Unit?: string | null
  MinStock?: number | null
}

export type UpdateProductInput = {
  ProductName?: string
  Unit?: string | null
  MinStock?: number | null
}

export async function getProducts(search?: string) {
  return prisma.products.findMany({
    where: search ? { ProductName: { contains: search } } : undefined,
    orderBy: { ProductID: 'desc' },
  })
}

export async function getProductById(id: number) {
  return prisma.products.findUnique({
    where: { ProductID: id },
  })
}

export async function createProduct(data: CreateProductInput) {
  if (!data.ProductName || data.ProductName.trim() === '') {
    throw new Error('Nama produk tidak boleh kosong')
  }
  if (data.MinStock != null && data.MinStock < 0) {
    throw new Error('Stok minimal tidak boleh negatif')
  }

  const product = await prisma.products.create({
    data: {
      ProductName: data.ProductName.trim(),
      Unit: data.Unit?.trim() || null,
      MinStock: data.MinStock ?? 0,
    },
  })

  revalidatePath('/products')
  revalidatePath('/')
  return product
}

export async function updateProduct(id: number, data: UpdateProductInput) {
  const existing = await prisma.products.findUnique({
    where: { ProductID: id },
  })

  if (!existing) {
    throw new Error(`Produk dengan ID ${id} tidak ditemukan`)
  }

  if (data.MinStock != null && data.MinStock < 0) {
    throw new Error('Stok minimal tidak boleh negatif')
  }

  const product = await prisma.products.update({
    where: { ProductID: id },
    data: {
      ProductName: data.ProductName?.trim() ?? existing.ProductName,
      Unit: data.Unit?.trim() ?? existing.Unit,
      MinStock: data.MinStock ?? existing.MinStock,
    },
  })

  revalidatePath('/products')
  revalidatePath('/')
  return product
}

export async function deleteProduct(id: number) {
  const existing = await prisma.products.findUnique({
    where: { ProductID: id },
  })

  if (!existing) {
    throw new Error(`Produk dengan ID ${id} tidak ditemukan`)
  }

  await prisma.products.delete({
    where: { ProductID: id },
  })

  revalidatePath('/products')
  revalidatePath('/')
  return { success: true, message: `Produk ID ${id} berhasil dihapus` }
}
