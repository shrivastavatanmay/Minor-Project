# 📊 Dataset Guide

## Datasets Used

### CK+
Facial expression dataset for emotion detection

### JAFFE
Japanese facial expression dataset

### TFEID
Student-age dataset (18–30)

### AffectNet
Large-scale dataset for pretraining

### FER2013
Benchmark dataset

---

## Strategy

1. Pretrain → AffectNet / FER2013  
2. Fine-tune → CK+, JAFFE, TFEID  
3. Test → Real student data  

---

## Note

Combining datasets improves accuracy and generalization.