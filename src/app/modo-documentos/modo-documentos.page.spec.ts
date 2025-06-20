import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModoDocumentosPage } from './modo-documentos.page';

describe('ModoDocumentosPage', () => {
  let component: ModoDocumentosPage;
  let fixture: ComponentFixture<ModoDocumentosPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ModoDocumentosPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
