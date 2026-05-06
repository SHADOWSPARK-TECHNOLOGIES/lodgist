import { NextRequest, NextResponse } from 'next/server';
import { propertyUpdateSchema } from '@/lib/validation/property';
import { auth } from '@/auth'; // NextAuth.js authentication
import { prisma } from '@/lib/prisma';
import * as z from 'zod';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const property = await prisma.property.findUnique({
      where: { id },
    });

    if (!property) {
      return NextResponse.json({ message: 'Property not found.' }, { status: 404 });
    }
    return NextResponse.json(property);
  } catch (error) {
    console.error('Error fetching property:', error);
    return NextResponse.json({ message: 'Failed to fetch property.' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || !session.user || !session.user.id) {
    return NextResponse.json({ message: 'Authentication required.' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const validatedData = propertyUpdateSchema.parse(body);

    // Optional: Check if the authenticated user is the owner of the property or an ADMIN
    const existingProperty = await prisma.property.findUnique({ where: { id } });
    if (!existingProperty) {
      return NextResponse.json({ message: 'Property not found.' }, { status: 404 });
    }
    // if (existingProperty.ownerId !== session.user.id && session.user.role !== 'ADMIN') {
    //   return NextResponse.json({ message: 'Unauthorized to update this property.' }, { status: 403 });
    // }

    const updatedProperty = await prisma.property.update({
      where: { id },
      data: validatedData,
    });
    return NextResponse.json(updatedProperty);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Validation error', errors: error.issues }, { status: 400 });
    }
    console.error('Error updating property:', error);
    return NextResponse.json({ message: 'Failed to update property.' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || !session.user || !session.user.id) {
    return NextResponse.json({ message: 'Authentication required.' }, { status: 401 });
  }

  try {
    const { id } = await params;

    // Optional: Check if the authenticated user is the owner of the property or an ADMIN
    const existingProperty = await prisma.property.findUnique({ where: { id } });
    if (!existingProperty) {
      return NextResponse.json({ message: 'Property not found.' }, { status: 404 });
    }
    // if (existingProperty.ownerId !== session.user.id && session.user.role !== 'ADMIN') {
    //   return NextResponse.json({ message: 'Unauthorized to delete this property.' }, { status: 403 });
    // }

    await prisma.property.delete({
      where: { id },
    });
    return NextResponse.json({ message: 'Property deleted successfully.' });
  } catch (error) {
    console.error('Error deleting property:', error);
    return NextResponse.json({ message: 'Failed to delete property.' }, { status: 500 });
  }
}