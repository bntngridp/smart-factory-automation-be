import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'

function safeRevalidate(path: string) {
  try {
    revalidatePath(path)
  } catch {}
}

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
  const product = await prisma.products.findUnique({
    where: { ProductID: id },
  })
  if (!product) {
    throw new Error(`Produk dengan ID ${id} tidak ditemukan`)
  }
  return product
}

export async function createProduct(data: CreateProductInput) {
  if (!data.ProductName || data.ProductName.trim() === '') {
    throw new Error('Nama produk wajib diisi')
  }
  if (data.MinStock != null && data.MinStock < 0) {
    throw new Error('Batas stok minimum tidak boleh bernilai negatif')
  }

  const product = await prisma.products.create({
    data: {
      ProductName: data.ProductName.trim(),
      Unit: data.Unit?.trim() || null,
      MinStock: data.MinStock ?? 0,
    },
  })

  safeRevalidate('/products')
  safeRevalidate('/')
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
    throw new Error('Batas stok minimum tidak boleh bernilai negatif')
  }

  const product = await prisma.products.update({
    where: { ProductID: id },
    data: {
      ProductName: data.ProductName?.trim() ?? existing.ProductName,
      Unit: data.Unit?.trim() ?? existing.Unit,
      MinStock: data.MinStock ?? existing.MinStock,
    },
  })

  safeRevalidate('/products')
  safeRevalidate('/')
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

  safeRevalidate('/products')
  safeRevalidate('/')
  return { success: true, message: `Produk ID ${id} berhasil dihapus` }
}
